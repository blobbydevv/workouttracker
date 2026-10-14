import { db } from "../db/db";
import { SyncEngine } from "./engine";

/** The app's single sync engine, bound to the app database. */
export const sync = new SyncEngine(db);
