self.__BUILD_MANIFEST = {
  "/": [
    "./static/chunks/78c52f2884a89b09.js"
  ],
  "/_error": [
    "./static/chunks/9efca27af184d967.js"
  ],
  "/admin/backup": [
    "./static/chunks/802e0cc5cdbfcae4.js"
  ],
  "/analytics": [
    "./static/chunks/00901426d327ece8.js"
  ],
  "/clients/[id]": [
    "./static/chunks/7f3b3f3d3446f357.js"
  ],
  "/dashboard": [
    "./static/chunks/fe9647bdfdfb50ab.js"
  ],
  "/profile": [
    "./static/chunks/15faf82c0c893795.js"
  ],
  "/transactions/[id]": [
    "./static/chunks/634082bed8ecba9d.js"
  ],
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/api/:path*",
        "destination": "/.netlify/functions/api/:path*"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/",
    "/_app",
    "/_error",
    "/admin/backup",
    "/analytics",
    "/api/hello",
    "/clients/[id]",
    "/dashboard",
    "/profile",
    "/transactions/[id]"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()