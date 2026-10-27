"""One-time export of MiVOLO v2 (age + gender, Apache-2.0) to ONNX.

The pipeline runs the exported file with ONNX Runtime (face_models.MiVOLO), so
camera machines never need PyTorch. Only this export step does, so run it in a
separate, throwaway environment:

  python3 -m venv /tmp/mivolo-export && source /tmp/mivolo-export/bin/activate
  pip install "setuptools<81" torch torchvision "timm==0.8.13.dev0" "transformers==4.51.0" \\
      "accelerate==1.8.1" scipy onnx onnxscript onnxruntime huggingface_hub safetensors opencv-python-headless
  # MiVOLO's own package, without its dependencies (they include AGPL ultralytics,
  # which only its person detector needs; we use YuNet for detection instead).
  pip install --no-deps --no-build-isolation \\
      "git+https://github.com/WildChlamydia/MiVOLO.git@37475e3f8818b5f22448003feec3e64b01bfb188"
  python tools/export_mivolo.py --out ~/.facesense/models/mivolo_v2.onnx

Pinned to the reviewed Hugging Face revision below. Loading it runs the model's
own Python code (trust_remote_code); that code only defines the network.

Model input:  (1, 6, 384, 384) float32 = face crop + body crop, each letterboxed
              to 384, RGB, ImageNet-normalised (an absent body is all zeros
              before normalisation).
Model output: (1, 3) = [male logit, female logit, raw age]; age in years is
              raw * (MAX_AGE - MIN_AGE) + AVG_AGE (see face_models.MiVOLO).
"""
import argparse
import hashlib
import os
import tempfile

import numpy as np
import torch

REPO = "iitolstykh/mivolo_v2"
REVISION = "53393526c220e34cdd7b722b36d22b6f9e5f4241"


class HeadOnly(torch.nn.Module):
    """Expose just the network: 6-channel input -> raw [gender logits, age]."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, x):
        return self.model(concat_input=x, return_dict=True).head_outputs


def main():
    ap = argparse.ArgumentParser(description="Export MiVOLO v2 to ONNX")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    from huggingface_hub import snapshot_download
    from transformers import AutoConfig, AutoModelForImageClassification

    src = snapshot_download(REPO, revision=REVISION, local_dir=tempfile.mkdtemp(prefix="mivolo_v2_"))
    config = AutoConfig.from_pretrained(src, trust_remote_code=True)
    model = AutoModelForImageClassification.from_pretrained(src, trust_remote_code=True, torch_dtype=torch.float32)
    net = HeadOnly(model.eval())

    out = os.path.expanduser(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    dummy = torch.randn(1, 6, 384, 384)
    # The dynamo exporter: the older TorchScript one can't translate VOLO's fold
    # (Col2Im, opset 18). Fixed shape, as the pipeline analyses one face at a time.
    torch.onnx.export(net, dummy, out, input_names=["input"], output_names=["head"],
                      opset_version=18, dynamo=True)
    # It writes the weights to a side file; merge them so there's one file to verify.
    import onnx
    onnx.save(onnx.load(out), out, save_as_external_data=False)
    if os.path.exists(out + ".data"):
        os.remove(out + ".data")

    # Check the ONNX graph reproduces PyTorch on a few random batches.
    import onnxruntime as ort
    sess = ort.InferenceSession(out, providers=["CPUExecutionProvider"])
    worst = 0.0
    with torch.no_grad():
        for _ in range(3):
            x = torch.randn(1, 6, 384, 384)
            ref = net(x).numpy()
            got = sess.run(None, {"input": x.numpy()})[0]
            worst = max(worst, float(np.abs(ref - got).max()))
    sha = hashlib.sha256(open(out, "rb").read()).hexdigest()
    print(f"wrote {out} ({os.path.getsize(out) / 1e6:.0f} MB), sha256 {sha}")
    print(f"max |onnx - torch| on random input: {worst:.2e}")
    print(f"age scale: min={config.min_age} max={config.max_age} avg={config.avg_age}; "
          f"gender labels {config.gender_id2label}")


if __name__ == "__main__":
    main()
