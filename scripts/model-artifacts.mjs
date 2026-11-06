// SHA-256 and byte counts verified against the Hugging Face API at these commits.
export const ARTIFACTS={
  embedding:{model:'Xenova/paraphrase-multilingual-MiniLM-L12-v2',revision:'2c4055b12046f11709e9df2c122e59ffbdc2f900',file:'onnx/model_quantized.onnx',bytes:118308126,sha256:'66fc00f5f29afcaff34092e1bdd20008ca3918265a82fb9695a551e510cc4ebc'},
  reranker:{model:'SugoLabs/mmarco-mMiniLMv2-L12-H384-v1',revision:'6772eee1ea62dc82e1fcaaf3ed90c269fdcb1fcf',file:'onnx/model_quantized.onnx',bytes:118235028,sha256:'6e57207c62deb625b5751a376f32ac66109281b0d199a2aec09f2671e066acf5'},
  generation:{model:'onnx-community/Qwen2.5-0.5B-Instruct',revision:'22942cb7d7ba4cc81bb4673549ca4d4614469b5e',file:'onnx/model_q4.onnx',bytes:786156820,sha256:'09235a3b1c135cd04ef570e5053b5c079e028078a2cc5f76ba6a251e91bf3296'}
};
