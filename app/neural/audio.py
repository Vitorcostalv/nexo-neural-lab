"""Bounded local microphone transcription; no cloud service and no saved audio."""
import io
import threading

import numpy as np
from fastapi import HTTPException

from app.config import ROOT

_model = None
_guard = threading.Lock()


def transcribe(payload):
    global _model
    if not _guard.acquire(blocking=False):
        raise HTTPException(409, 'Uma transcrição já está em andamento.')
    try:
        import av
        from faster_whisper import WhisperModel
        model_path = ROOT/'models'/'whisper-small'
        if not (model_path/'model.bin').exists():
            raise HTTPException(503, 'O modelo local Whisper não está instalado. Use a entrada de texto.')
        try:
            frames, duration = [], 0
            with av.open(io.BytesIO(payload)) as container:
                resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
                for frame in container.decode(audio=0):
                    duration += frame.samples / frame.sample_rate
                    if duration > 31:
                        raise HTTPException(413, 'Grave no máximo 30 segundos.')
                    frames.extend(f.to_ndarray().reshape(-1).copy() for f in resampler.resample(frame))
                frames.extend(f.to_ndarray().reshape(-1).copy() for f in resampler.resample(None))
            if not frames:
                raise ValueError('Áudio vazio')
            audio = np.concatenate(frames).astype(np.float32)/32768
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, 'Áudio inválido. Grave novamente ou use texto.') from exc
        if _model is None:
            _model = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=2, num_workers=1, local_files_only=True)
        segments, _ = _model.transcribe(audio, language='pt', beam_size=3, vad_filter=True, condition_on_previous_text=False)
        return {'text':' '.join(s.text.strip() for s in segments).strip(), 'seconds':round(duration,2), 'saved_audio':False}
    finally:
        _guard.release()
