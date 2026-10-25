export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error("DATABASE_URL required: use owned cluster launcher");
  const url = new URL(value);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55482" ||
    url.username !== "atlas" ||
    url.pathname !== "/postgres"
  )
    throw new Error(
      "Teaching fixture only: loopback atlas/postgres port 55482",
    );
  return value;
}
