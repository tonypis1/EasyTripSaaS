import { BaseController } from "@/server/controllers/BaseController";
import { AuthService } from "@/server/services/auth/authService";
import { UserDataService } from "@/server/services/privacy/userDataService";
import { AppError } from "@/server/errors/AppError";
import { deleteAccountSchema } from "@/server/validators/user.schema";
import { DELETE_ACCOUNT_CONFIRM_PHRASES } from "@/lib/user/delete-account-confirm-phrases";

export class UserController extends BaseController {
  constructor(
    private readonly authService: AuthService,
    private readonly userDataService: UserDataService,
  ) {
    super();
  }

  /** Portabilità dati (GDPR Art. 20): export JSON dell'utente autenticato. */
  async exportData() {
    try {
      const user = await this.authService.getOrCreateCurrentUser();
      const data = await this.userDataService.exportAllDataForUserId(user.id);

      return this.ok(data, 200, {
        "Content-Disposition": `attachment; filename="easytrip-data-export-${user.id}.json"`,
      });
    } catch (error) {
      return this.fail(error, "UserController.exportData");
    }
  }

  /** Cancellazione account coordinata: Stripe → database → Clerk (diritto all'oblio). */
  async deleteAccount(req: Request) {
    try {
      const body = await req.json();
      const input = deleteAccountSchema.parse(body);

      const trimmed = input.confirm.trim();
      if (!DELETE_ACCOUNT_CONFIRM_PHRASES.has(trimmed)) {
        throw new AppError(
          "Frase di conferma non valida. Digita la formula esatta mostrata nella pagina, nella tua lingua.",
          400,
          "CONFIRMATION_REQUIRED",
        );
      }

      const user = await this.authService.getOrCreateCurrentUser();
      await this.userDataService.deleteAccountForUser({
        prismaUserId: user.id,
        clerkUserId: user.clerkUserId,
        stripeCustomerId: user.stripeCustomerId,
      });

      return this.ok({ deleted: true });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "UserController.deleteAccount",
        );
      }
      return this.fail(error, "UserController.deleteAccount");
    }
  }
}
