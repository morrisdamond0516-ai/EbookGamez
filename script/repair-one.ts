import "./load-env.ts";
import { repairIncompleteChapters } from "../server/contentStudio";
const id = parseInt(process.argv[2] || "714", 10);
await repairIncompleteChapters(id);
console.log(`#${id} repair complete`);
