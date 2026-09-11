export default {
  name: 'support-agent-target',
  async run(input: { message?: string }) {
    const msg = (input.message || '').toLowerCase();
    if (msg.includes('user_123')) {
      return {
        output: 'Found order #99281 for user_123.',
        tool_calls: [
          { name: 'search_customer', arguments: { userId: 'user_123' } }
        ]
      };
    }
    if (msg.includes('user_456')) {
      return {
        output: 'Shipping address updated for user_456.',
        tool_calls: [
          { name: 'search_customer', arguments: { userId: 'user_456' } },
          { name: 'update_shipping_address', arguments: { userId: 'user_456', address: '123 Main St' } }
        ]
      };
    }
    return { output: 'No action taken' };
  }
};
