"""Generate clearly synthetic event logs for UI testing; never runs training."""
import argparse
import math
from pathlib import Path
import time
from tensorboard.compat.proto.event_pb2 import Event
from tensorboard.compat.proto.summary_pb2 import Summary
from tensorboard.summary.writer.event_file_writer import EventFileWriter

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=False)
for run in range(2):
    writer = EventFileWriter(str(args.output / f"synthetic-demo-{run+1}"))
    now = time.time()
    for step in range(201):
        loss = 1.8 * math.exp(-step / (55 + run * 15)) + .12 + .025 * math.sin(step / 4)
        values = {"train/loss": loss, "validation/loss": loss + .12 + .03 * math.sin(step / 9),
                  "validation/accuracy": .4 + .5 * (1 - math.exp(-step / 70)),
                  "optimizer/learning_rate": .001 * (1 - step / 250)}
        writer.add_event(Event(wall_time=now-(200-step)*2, step=step,
                               summary=Summary(value=[Summary.Value(tag=k, simple_value=v) for k,v in values.items()])))
    writer.close()
print("Synthetic demonstration logs created; not experimental evidence.")
