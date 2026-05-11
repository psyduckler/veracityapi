import { VeracityClient } from "../src/veracity-client.js";
import { summarizeAnalysisResult, summarizeBalance } from "../src/summaries.js";

const client = new VeracityClient();

const balance = await client.getBalance();
console.log(summarizeBalance(balance));

const text = await client.analyzeText({
  text: "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
  context: { format: "article", intended_use: "publish", domain: "travel safety" },
  privacy_mode: true,
});
console.log(summarizeAnalysisResult("text", text));
