import {Vector2D} from './vector2D.model';
import {ComponentIdentifier} from 'naive-ts-ecs';

export class Movable implements ComponentIdentifier {
  public static readonly identifier = 'Movable';

  constructor(
    public position: Vector2D,
    public velocity: Vector2D,
    public speed: number,
  ) { }

  public identifier(): string {
    return Movable.identifier;
  }
}
