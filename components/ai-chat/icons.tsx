import type { SVGProps, ReactNode } from "react";
export type IconName = "alert" | "chat" | "chevron-down" | "clock" | "close" | "copy" | "globe" | "hourglass" | "info" | "line" | "pause" | "phone" | "retry" | "send" | "settings-pending" | "stop" | "text-long" | "wechat" | "whatsapp" | "wifi-off";
const paths: Record<IconName, ReactNode> = {
"alert": <><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2h.01"/></>,
"chat": <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="3"/></>,
"chevron-down": <><path d="M6 9l6 6 6-6"/></>,
"clock": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
"close": <><path d="M6 6l12 12M18 6L6 18"/></>,
"copy": <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></>,
"globe": <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
"hourglass": <><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></>,
"info": <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></>,
"line": <><path d="M12 4c-5 0-9 3.1-9 7 0 3.4 3 6.3 7.2 6.9l-.6 2.6c-.1.4.3.7.7.5 2.9-1.6 5.6-3.4 7.5-5.4A6.5 6.5 0 0 0 21 11c0-3.9-4-7-9-7z"/><path d="M8 9.5v3h1.6M11 9.5v3M13.2 12.5v-3l2.3 3v-3"/></>,
"pause": <><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></>,
"phone": <><path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/></>,
"retry": <><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></>,
"send": <><path d="M5 12h14M13 6l6 6-6 6"/></>,
"settings-pending": <><circle cx="12" cy="12" r="9" strokeDasharray="3 3"/><path d="M12 8v4M12 15.5h.01"/></>,
"stop": <><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></>,
"text-long": <><path d="M4 6h16M4 10h16M4 14h10M17 14l3 3-3 3"/></>,
"wechat": <><path d="M15 9.2C14.6 6.3 11.8 4 8.5 4 4.9 4 2 6.6 2 9.7c0 1.8 1 3.4 2.5 4.4l-.6 2 2.3-1.2c.7.2 1.5.3 2.3.3"/><path d="M22 14.8c0-2.8-2.7-5-6-5s-6 2.2-6 5 2.7 5 6 5c.7 0 1.3-.1 1.9-.3l2 1.1-.5-1.8c1.6-.9 2.6-2.3 2.6-4z"/><path d="M6.2 8.2h.01M10.6 8.2h.01M14 14h.01M18 14h.01" strokeWidth="2.6"/></>,
"whatsapp": <><path d="M20 11.6A8.3 8.3 0 0 1 7.8 19L4 20l1.1-3.6A8.3 8.3 0 1 1 20 11.6z"/><path d="M9 8.5c0 3.4 3 6.5 6.4 6.5l.9-1.6-2-1-1 .8a5 5 0 0 1-2.6-2.6l.8-1-1-2z"/></>,
"wifi-off": <><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.3-2.7M10.7 6A15 15 0 0 1 22 9.5M12 20h.01"/></>,
};
export function ChatIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
 return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={name === "chevron-down" || name === "close" || name === "send" ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
