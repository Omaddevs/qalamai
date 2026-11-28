# QalamAI's own Uzbek voice (tts/server.py): tiny-voca on the CPU, no GPU, no paid service.
# The model is downloaded at build time at a fixed revision, so a later change upstream
# can't change (or break) the voice without a deliberate update here.
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.4,<3" \
 && pip install --no-cache-dir "numpy>=1.24,<3" "huggingface_hub>=0.24,<1"
ARG MODEL_REPO=Inomjonov/tiny-voca-uzbek-navoiy
ARG MODEL_REVISION=3d960bd05c728b21fff4ec5154cada7f6b082df1
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('${MODEL_REPO}', revision='${MODEL_REVISION}', local_dir='/model', allow_patterns=['inference.pt','src/**','uzbek_normalize.py','LICENSE','NOTICE','licenses/**'])"
COPY tts/server.py ./
ENV TTS_MODEL_DIR=/model TTS_PORT=8000 TTS_THREADS=2 PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health',timeout=4)"
CMD ["python", "server.py"]
