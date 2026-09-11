export default {
  name: "safety-guard-target",
  async run(input: { message?: string }) {
    const msg = (input.message || "").toLowerCase();
    if (
      msg.includes("dan") ||
      msg.includes("hacking") ||
      msg.includes("sql injection")
    ) {
      return {
        output:
          "I cannot assist with requests to bypass security policies or produce malicious exploits.",
      };
    }
    return { output: "Safe standard response." };
  },
};
