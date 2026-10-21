// Where the students go after the webinar. A deployed-resource URL, so it comes from .env
// (VITE_MYSTICA_URL) and never from the repo. Empty means "not set": the ending shows a greyed
// QR, the gate stays an ordinary moongate and the QR widget keeps the room code.
export const MYSTICA_URL = ((import.meta.env.VITE_MYSTICA_URL as string | undefined) ?? "").trim().replace(/\/$/, "");
