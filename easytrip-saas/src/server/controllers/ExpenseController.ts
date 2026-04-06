import { BaseController } from "@/server/controllers/BaseController";
import { ExpenseService } from "@/server/services/expense/expenseService";
import { createExpenseSchema } from "@/server/validators/expense.schema";
import { AppError } from "@/server/errors/AppError";

export class ExpenseController extends BaseController {
  constructor(private readonly expenseService: ExpenseService) {
    super();
  }

  async create(tripId: string, req: Request) {
    try {
      const body = await req.json();
      const input = createExpenseSchema.parse(body);
      const expense = await this.expenseService.addExpense(tripId, input);
      return this.ok(expense, 201);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(
          new AppError("Body JSON non valido", 400, "INVALID_JSON"),
          "ExpenseController.create",
        );
      }
      return this.fail(error, "ExpenseController.create");
    }
  }

  async list(tripId: string) {
    try {
      const expenses = await this.expenseService.listExpenses(tripId);
      return this.ok(expenses);
    } catch (error) {
      return this.fail(error, "ExpenseController.list");
    }
  }

  async remove(tripId: string, expenseId: string) {
    try {
      const result = await this.expenseService.deleteExpense(tripId, expenseId);
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "ExpenseController.remove");
    }
  }

  async balances(tripId: string) {
    try {
      const result = await this.expenseService.getBalances(tripId);
      return this.ok(result);
    } catch (error) {
      return this.fail(error, "ExpenseController.balances");
    }
  }
}
