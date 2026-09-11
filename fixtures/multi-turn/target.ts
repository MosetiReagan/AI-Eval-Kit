export default {
  name: "multi-turn-target",
  async run(input: { messages?: Array<{ role: string; content: string }> }) {
    const msgs = input.messages || [];
    const lastMsg = msgs[msgs.length - 1]?.content || "";
    if (lastMsg.includes("#5512")) {
      return {
        output:
          "I have located order #5512. A return label has been emailed to you.",
      };
    }
    return { output: "How can I assist with your order?" };
  },
};
