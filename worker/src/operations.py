"""
Task Operations - Core processing logic for all supported AI task types
"""
import re
from typing import Any, Dict


def process_operation(operation: str, input_text: str) -> Dict[str, Any]:
    """
    Route to the correct operation handler.
    Returns a structured result dict.
    """
    handlers = {
        "uppercase": op_uppercase,
        "lowercase": op_lowercase,
        "reverse": op_reverse,
        "word_count": op_word_count,
    }

    handler = handlers.get(operation)
    if not handler:
        raise ValueError(f"Unsupported operation: '{operation}'. Valid: {list(handlers.keys())}")

    return handler(input_text)


def op_uppercase(text: str) -> Dict[str, Any]:
    result = text.upper()
    return {
        "output": result,
        "operation": "uppercase",
        "inputLength": len(text),
        "outputLength": len(result),
        "charactersChanged": sum(1 for a, b in zip(text, result) if a != b),
    }


def op_lowercase(text: str) -> Dict[str, Any]:
    result = text.lower()
    return {
        "output": result,
        "operation": "lowercase",
        "inputLength": len(text),
        "outputLength": len(result),
        "charactersChanged": sum(1 for a, b in zip(text, result) if a != b),
    }


def op_reverse(text: str) -> Dict[str, Any]:
    result = text[::-1]
    return {
        "output": result,
        "operation": "reverse",
        "inputLength": len(text),
        "outputLength": len(result),
        "isPalindrome": text.lower().replace(" ", "") == result.lower().replace(" ", ""),
    }


def op_word_count(text: str) -> Dict[str, Any]:
    words = text.split()
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chars_no_space = len(text.replace(" ", "").replace("\n", ""))

    # Frequency map (top 10 words)
    word_freq: Dict[str, int] = {}
    for word in words:
        clean = re.sub(r"[^a-zA-Z0-9]", "", word).lower()
        if clean:
            word_freq[clean] = word_freq.get(clean, 0) + 1

    top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "output": f"{len(words)} words",
        "operation": "word_count",
        "wordCount": len(words),
        "characterCount": len(text),
        "characterCountNoSpaces": chars_no_space,
        "sentenceCount": len(sentences),
        "paragraphCount": len(paragraphs),
        "averageWordLength": round(sum(len(w) for w in words) / len(words), 2) if words else 0,
        "topWords": [{"word": w, "count": c} for w, c in top_words],
        "uniqueWordCount": len(word_freq),
    }
