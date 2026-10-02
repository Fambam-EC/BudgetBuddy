# BudgetBuddy
BudgetBuddy is a React Native budget app targeting Android, iOS, and Web. The Express API and PostgreSQL database support accounts, JWT sessions, budgets, invitations, and budget history.

The standalone [BudgetBuddy Privacy Policy](./privacy-policy.html) describes the app's current data practices.

## Architecture

- `App.tsx` contains the shared React Native experience.
- Android and iOS use React Native CLI; Web uses React Native Web and Webpack.
- `BudgetBuddy.Api` is the Express API. PostgreSQL is the only service started by Docker Compose.
- Native storage uses MMKV. Web storage uses browser `localStorage` through the platform-specific adapter.

## Local Development

Start PostgreSQL from the project root:

```sh
docker compose up -d postgres
```

In a second terminal, configure and start the API:

```sh
cd BudgetBuddy.Api
cp .env.example .env
npm install
npm start
```

Set a long random `JWT_SECRET` in `BudgetBuddy.Api/.env`. Configure `MAILJET_API_KEY`, `MAILJET_API_SECRET`, and `MAILJET_FROM_EMAIL` to send email through Mailjet SMTP (`in-v3.mailjet.com:587` by default). `MAILJET_SMTP_HOST` and `MAILJET_SMTP_PORT` can override the SMTP endpoint. Set `PASSWORD_RESET_URL` and `BUDGET_INVITE_URL` to enable password reset and email invitations. Never commit `.env` files.

### Expose the API with Cloudflare Tunnel

The API and PostgreSQL stay on the local machine; Cloudflare Tunnel publishes only the API over HTTPS. PostgreSQL remains available to the API at `127.0.0.1:5432` and is bound to the host loopback interface. A deployed Cloudflare Worker cannot connect to a developer machine's `localhost`.

1. Install `cloudflared` and authenticate with your Cloudflare account:

   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create budgetbuddy-api
   ```

2. Create a DNS route for a hostname in a domain managed by Cloudflare (replace the example hostname):

   ```powershell
   cloudflared tunnel route dns budgetbuddy-api api.budgetbuddy.me
   ```

3. Copy `cloudflared\config.yml.example` to `%USERPROFILE%\.cloudflared\config.yml`. Replace `YOUR_TUNNEL_UUID` and `YOUR_WINDOWS_USERNAME` with the tunnel UUID printed by the create command and your Windows username. Keep the generated tunnel credentials outside the repository.

4. Start PostgreSQL and the API in separate terminals:

   ```powershell
   docker compose up -d postgres
   cd BudgetBuddy.Api
   npm start
   ```

   The API runs on `127.0.0.1:3000`, and `.env` must contain the PostgreSQL credentials configured in `docker-compose.yml`. Change `JWT_SECRET` to a long random value before exposing the API.

5. Run the named tunnel:

   ```powershell
   cloudflared tunnel run budgetbuddy-api
   ```

6. If browser clients call the API from a different website, add that website's HTTPS origin to `CORS_ORIGINS` in `BudgetBuddy.Api/.env`. The client API URL is `https://api.budgetbuddy.me`. Native clients do not require a CORS origin.

The tunnel process must stay running for the API to remain reachable. Never expose PostgreSQL through the tunnel or commit tunnel credentials or `.env` files.

Start the Web client from the project root with `npm run web`. For native targets, run `npm start`, then use `npm run android` or `npm run ios` with the corresponding development environment configured.

Run the API’s database-independent checks from `BudgetBuddy.Api` with `npm test`; run the client smoke tests from the project root with `npm test`.

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
