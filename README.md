This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment

Create a local env file from the template:

```bash
cp .env.example .env.local
```

Environment variables:

```bash
STRAPI_URL=
STRAPI_TOKEN=
LDAP_URL=ldaps://ukb.klinik.bn:636
LDAP_SEARCH_BASE=OU=Administration,DC=ukb,DC=klinik,DC=bn
LDAP_BIND_DN=
LDAP_BIND_PASSWORD=
LDAP_USER_FILTER=(sAMAccountName={{username}})
AUTH_SESSION_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_SECURE=
```

LDAP authentication uses a read-only directory bind account to find the login DN in the configured search base and then validates the submitted password by binding as that user. Keep `LDAP_URL` on LDAPS and ensure the server certificate is trusted by Node.js. Generate `AUTH_SESSION_SECRET` as a random value of at least 32 characters. Do not commit `.env.local` or service-account credentials.

For example, generate the session secret with `openssl rand -base64 48` and provide it through the deployment secret store.

To enable a person's own profile editing, set that person's `LDAPUsername` field in Strapi to the matching `sAMAccountName`. Organization managers are Organization Leadership entries with `CanManageAssignments` enabled; they must point to a Person with a matching `LDAPUsername`. A manager can maintain memberships, add/remove managers, and manage child units in their organization and descendants. Parent-child organization links are configured with `ParentOrganization`.

LDAP service-account credentials and the actual LDAP endpoint/network access must be configured in the deployment environment. The current directory sync is only prepared in the data model: people have a stable `LDAPUsername`, organizations an `LDAPOrganizationId`, and both record `LDAPLastSyncedAt`. A recurring import still needs approved LDAP attribute mappings and field ownership rules before it can safely write data.

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
