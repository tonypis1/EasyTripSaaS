# EasyTrip SaaS

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

After `npm install` or changes to `prisma/schema.prisma`, the Prisma Client is regenerated via `postinstall`. If you see **"@prisma/client did not initialize"**, run:

```bash
npm run db:generate
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## E2E tests (Playwright)

Install browser binaries:

```bash
npm run playwright:install
```

Run tests:

```bash
npm run test:e2e
```

Run with headed browser:

```bash
npm run test:e2e:headed
```

### Env for checkout E2E

- `E2E_AUTH_STORAGE_STATE`: path to Playwright storage state with logged-in user
- `E2E_TRIP_ID`: trip id to open in `/app/trips/:tripId`
- `E2E_BASE_URL` (optional): defaults to `http://127.0.0.1:3000`
