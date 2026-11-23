#!/usr/bin/env python3
"""홍보 영상 나레이션 — 인터넷 음성 서비스 없이 기기 안에서 합성한다.
  python3 scripts/ad-voice.py "먼지는 한 번에 쓱." out.wav [빠르기 0.8~1.3, 기본 1.05] [목소리 0~9, 기본 5] [언어 ko|en, 기본 ko]
목소리: Supertonic 2 (Supertone, 한국어·영어 지원, 44.1kHz) — sherpa-onnx tts-models 배포본을 처음 한 번 내려받아 ~/.cache/sparkle-ad-voice 에 둔다(약 85MB).
  목소리 번호 0~4 는 남성, 5~9 는 여성 계열(모델에 든 10가지 음색).
필요한 것: pip install sherpa-onnx soundfile numpy  (클라우드 환경은 --break-system-packages)
"""
import os, sys, tarfile, urllib.request

MODEL = "sherpa-onnx-supertonic-tts-int8-2026-03-06"
URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{MODEL}.tar.bz2"
CACHE = os.path.expanduser("~/.cache/sparkle-ad-voice")


def model_dir():
    d = os.path.join(CACHE, MODEL)
    if not os.path.exists(os.path.join(d, "tts.json")):
        os.makedirs(CACHE, exist_ok=True)
        tmp = os.path.join(CACHE, MODEL + ".tar.bz2")
        urllib.request.urlretrieve(URL, tmp)
        with tarfile.open(tmp) as t:
            t.extractall(CACHE, filter="data")
        os.remove(tmp)
    return d


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    text, out = sys.argv[1], sys.argv[2]
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.05
    sid = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    lang = sys.argv[5] if len(sys.argv) > 5 else "ko"
    import numpy as np
    import sherpa_onnx
    import soundfile as sf

    d = model_dir()
    p = lambda f: os.path.join(d, f)
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
            duration_predictor=p("duration_predictor.int8.onnx"), text_encoder=p("text_encoder.int8.onnx"),
            vector_estimator=p("vector_estimator.int8.onnx"), vocoder=p("vocoder.int8.onnx"),
            tts_json=p("tts.json"), unicode_indexer=p("unicode_indexer.bin"), voice_style=p("voice.bin")),
        num_threads=2)))
    g = sherpa_onnx.GenerationConfig()
    g.sid = sid
    g.speed = speed
    g.num_steps = 10  # 많을수록 또렷하다(느려진다)
    g.extra = {"lang": lang}
    # 문장을 잘라 이어 붙이지 않고 한 번에 합성한다 — 잘라 붙이면 문장 사이가 뚝뚝 끊겨 들린다
    a = tts.generate(text, g)
    wav = np.asarray(a.samples, dtype=np.float32)
    # 앞뒤의 긴 무음을 걷어 내고, 끝을 부드럽게 줄인다
    loud = np.where(np.abs(wav) > 0.01)[0]
    if len(loud):
        sr = a.sample_rate
        wav = wav[max(0, loud[0] - int(0.03 * sr)): min(len(wav), loud[-1] + int(0.12 * sr))]
        n = int(0.06 * sr)
        wav[-n:] *= np.linspace(1, 0, n, dtype=np.float32)
    peak = float(np.abs(wav).max()) or 1.0
    sf.write(out, wav * (0.89 / peak), a.sample_rate)
    print(round(len(wav) / a.sample_rate, 2))


if __name__ == "__main__":
    main()
