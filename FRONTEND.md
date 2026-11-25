# React frontend

The React + Vite interface uses the existing Java services and SQLite database through the built-in Java HTTP server.

## Start the Java API

From the project directory, compile the Java sources and start the API:

```powershell
$sources = Get-ChildItem -Path src -Recurse -Filter *.java | ForEach-Object { $_.FullName }
javac -encoding UTF-8 -cp "lib/*" -d bin $sources
java -cp "bin;lib/*" com.predmaint.ApiServer
```

The API listens on `http://localhost:8080`. Keep this terminal open.

## Start the React app

In a second terminal in the project directory:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The Vite development server proxies `/api` requests to the Java API.