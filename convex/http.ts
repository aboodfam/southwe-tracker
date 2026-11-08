import { serveRecaps } from "./nativeRecaps";
import { auth } from "./auth";
import router from "./router";

const http = router;

http.route({ path: "/android/recaps", method: "POST", handler: serveRecaps });

auth.addHttpRoutes(http);

export default http;
