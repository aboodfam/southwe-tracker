# SouthWe Tracker

This is the recovered Chef project. Chef is not required to run or deploy it. The app is a standard React + Vite frontend with a Convex backend and Convex Auth.

## Fastest recovery (Windows)

Requirements: Node.js 20 or newer and a free Convex account.

1. Extract the ZIP and open a terminal in the project folder.
2. Install packages:

   ```bash
   npm install
   ```

3. Connect the project to a **new Convex project**:

   ```bash
   npx convex dev
   ```

   Sign in when asked, choose **Create a new project**, and leave this command running until the backend finishes syncing. It will create a fresh `.env.local` containing `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL`.

4. In a second terminal, configure Convex Auth:

   ```bash
   npx @convex-dev/auth --skip-git-check
   ```

5. Start the full app:

   ```bash
   npm run dev
   ```

The local site opens at `http://localhost:5173`.

## Deploy online with Vercel

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. In the Convex dashboard, open the project's **Production** deployment settings and generate a production deploy key.
4. Add this Vercel environment variable for Production:

   ```text
   CONVEX_DEPLOY_KEY=your-production-deploy-key
   ```

5. Set Vercel's Build Command to:

   ```bash
   npx convex deploy --cmd "npm run build"
   ```

6. Set Output Directory to:

   ```text
   dist
   ```

7. Deploy once, then configure Convex Auth for the production deployment. In the Convex production deployment's Environment Variables, ensure `JWT_PRIVATE_KEY` and `JWKS` exist. For this app's password/anonymous login, `SITE_URL` is optional, but setting it to the final Vercel URL is recommended.

## Local production build

```bash
npm run build
```

The static frontend is generated in `dist/`.

## Important recovery note

The old Chef-linked deployment (`superb-sockeye-44`) was removed, so its database contents cannot be restored from this source ZIP alone. The application code is intact, but the new deployment starts with an empty database and new user accounts.
