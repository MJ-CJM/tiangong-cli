#!/bin/bash

export DEBUG_MESSAGE_FORMAT=1
export DEBUG_MODEL_REQUESTS=1
export QWEN_CODER_API_KEY=dummy_key

echo "你是谁？" | npm start -- --model deepseek-coder
