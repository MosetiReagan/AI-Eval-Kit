export default {
  name: "json-extractor-target",
  async run(input: { message?: string }) {
    return {
      output: JSON.stringify(
        {
          name: "Alice Smith",
          age: 30,
          email: "alice@example.com",
        },
        null,
        2,
      ),
    };
  },
};
