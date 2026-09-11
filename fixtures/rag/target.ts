export default {
  name: 'rag-target',
  async run(input: { message?: string; context?: string }) {
    const msg = (input.message || '').toLowerCase();
    if (msg.includes('curiosity') || msg.includes('mars')) {
      return {
        output: 'According to [Doc 1], Curiosity rover landed on Mars on August 6, 2012.'
      };
    }
    if (msg.includes('speed of light')) {
      return {
        output: 'The speed of light in vacuum is approximately 299,792,458 meters per second [Doc 2].'
      };
    }
    return { output: 'Information not found in context.' };
  }
};
