import {Vector2D} from './vector2D.model';

export interface Movable {
  position: Vector2D,
  velocity: Vector2D,
  speed: number,
}