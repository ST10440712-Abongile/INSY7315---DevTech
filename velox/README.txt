VELOX — deploy to get your link
================================
Your Firebase keys are already inside public/index.html (project velox-app-42aa7).

1. In the Firebase console: Build > Authentication > enable Email/Password (and Google if wanted).
   Build > Hosting > Get started (once).
2. In this folder, run:
     npx firebase-tools login
     npx firebase-tools deploy --only hosting
3. Your link will be:  https://velox-app-42aa7.web.app
   (also https://velox-app-42aa7.firebaseapp.com — both are authorised for sign-in automatically)

Works on any other host too: upload public/index.html and add that domain under
Authentication > Settings > Authorized domains.
