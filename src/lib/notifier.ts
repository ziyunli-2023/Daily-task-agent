import notifier from "node-notifier";
import path from "path";

export function sendNotification(title: string, message: string) {
  notifier.notify({
    title,
    message,
    sound: true,
    wait: false,
    icon: path.join(process.cwd(), "public", "icon-192.png"),
  });
}
