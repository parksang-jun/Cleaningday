#!/usr/bin/env python3
"""홍보 영상 나레이션(한국어) — 인터넷 음성 서비스 없이 기기 안에서 합성한다.
  python3 scripts/ad-voice.py "먼지는 한 번에 쓱." out.wav [빠르기 0.8~1.2, 기본 0.95]
목소리: KSS(한국어 여성 화자)로 학습한 공개 VITS 모델(sherpa-onnx tts-models 배포본). 처음 한 번 내려받아 ~/.cache/sparkle-ad-voice 에 둔다.
필요한 것: pip install piper-tts onnxruntime soundfile numpy  (클라우드 환경은 --break-system-packages)
한국어만 된다. 다른 언어는 자막으로만 넣는다.
"""
import os, sys, tarfile, urllib.request

MODEL = "vits-mimic3-ko_KO-kss_low"
URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{MODEL}.tar.bz2"
CACHE = os.path.expanduser("~/.cache/sparkle-ad-voice")


def model_dir():
    d = os.path.join(CACHE, MODEL)
    if not os.path.exists(os.path.join(d, "tokens.txt")):
        os.makedirs(CACHE, exist_ok=True)
        tmp = os.path.join(CACHE, MODEL + ".tar.bz2")
        urllib.request.urlretrieve(URL, tmp)
        with tarfile.open(tmp) as t:
            t.extractall(CACHE)
        os.remove(tmp)
    return d


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    text, out = sys.argv[1], sys.argv[2]
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 0.95
    import numpy as np
    import onnxruntime as ort
    import soundfile as sf
    from piper.phonemize_espeak import EspeakPhonemizer

    d = model_dir()
    tok = {}
    for line in open(os.path.join(d, "tokens.txt"), encoding="utf8"):
        line = line.rstrip("\n")
        if line:
            s, i = line.rsplit(" ", 1)
            tok[s] = int(i)
    sess = ort.InferenceSession(os.path.join(d, "ko_KO-kss_low.onnx"))
    parts = []
    for sent in EspeakPhonemizer().phonemize("ko", text):
        ids = [tok["^"], 0]
        for p in sent:
            if p == " ":
                ids += [tok["#"], 0]
            elif p in tok:
                ids += [tok[p], 0]
        ids.append(tok["$"])
        # scales: 음색 흔들림, 길이(클수록 느림), 발음 길이 흔들림
        audio = sess.run(None, {
            "input": np.array([ids], dtype=np.int64),
            "input_lengths": np.array([len(ids)], dtype=np.int64),
            "scales": np.array([0.667, 1.0 / speed, 0.8], dtype=np.float32),
        })[0].squeeze()
        parts += [audio, np.zeros(int(22050 * 0.16), dtype=np.float32)]
    wav = np.concatenate(parts)
    peak = float(np.abs(wav).max()) or 1.0
    sf.write(out, wav * (0.89 / peak), 22050)
    print(round(len(wav) / 22050, 2))


if __name__ == "__main__":
    main()
