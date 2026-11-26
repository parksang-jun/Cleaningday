#!/usr/bin/env python3
"""홍보 영상 영어 나레이션 — Kokoro(자연스러운 영어 음성, Apache-2.0)로 기기 안에서 합성한다.
  python3 scripts/ad-voice-en.py "Muddy rug? Watch this." out.wav [빠르기 0.8~1.3, 기본 1.0] [목소리 번호, 기본 3]
목소리(미국 영어): 3 af_heart(여, 기본) · 2 af_bella(여) · 7 af_nova(여) · 12 am_fenrir(남) · 16 am_michael(남) 등 — 모델 README 참고.
모델(sherpa-onnx tts-models 의 kokoro-multi-lang-v1_0, 약 350MB)은 처음 한 번 내려받아 ~/.cache/sparkle-ad-voice 에 둔다.
한국어는 지원하지 않는다(영어·중국어만).
필요한 것: pip install sherpa-onnx soundfile numpy  (클라우드 환경은 --break-system-packages)
"""
import os, sys, tarfile, urllib.request

MODEL = "kokoro-multi-lang-v1_0"
URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{MODEL}.tar.bz2"
CACHE = os.path.expanduser("~/.cache/sparkle-ad-voice")


def model_dir():
    d = os.path.join(CACHE, MODEL)
    if not os.path.exists(os.path.join(d, "model.onnx")):
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
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    sid = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    import sherpa_onnx
    import soundfile as sf

    d = model_dir()
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=f"{d}/model.onnx", voices=f"{d}/voices.bin", tokens=f"{d}/tokens.txt",
                data_dir=f"{d}/espeak-ng-data", dict_dir=f"{d}/dict", lexicon=f"{d}/lexicon-us-en.txt",
            ),
            num_threads=4,
        )
    )
    a = sherpa_onnx.OfflineTts(cfg).generate(text, sid=sid, speed=speed)
    if len(a.samples) == 0:
        sys.exit("no audio")
    import numpy as np

    x = np.asarray(a.samples, dtype=np.float32)
    x = x * (0.9 / max(1e-6, float(np.abs(x).max())))  # 음량을 한국어 음성과 맞춘다
    sf.write(out, x, a.sample_rate)


if __name__ == "__main__":
    main()
