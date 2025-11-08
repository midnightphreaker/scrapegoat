import "dotenv/config";
import { runCli } from "./cli/main";

// Run the CLI
runCli().catch((error) => {
  console.error(`🔥 Fatal error in main execution: ${error}`);
  process.exit(1);
});
