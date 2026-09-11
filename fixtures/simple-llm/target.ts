export default {
  name: 'simple-target',
  async run(input: { message?: string }) {
    const msg = (input.message || '').toLowerCase();
    if (msg.includes('hello')) return { output: 'Hello! How can I help you today?' };
    if (msg.includes('2+2')) return { output: '4' };
    return { output: 'Unknown query' };
  }
};
