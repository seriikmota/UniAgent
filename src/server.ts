import * as dotenv from "dotenv";
import app from "./app";

dotenv.config();

const pgUser = process.env.PG_USER;
const pgPass = process.env.PG_PASS;
const pgUrl = process.env.PG_URL;
const pgDb = process.env.PG_DB;
const port = process.env.PORT;
const connectionString = `postgresql://${pgUser}:${pgPass}@${pgUrl}/${pgDb}`;
export const pool = new Pool({connectionString: connectionString});

const server = app.listen(port);

server.on("listening", () => console.log(`Server running on ${port}`));
