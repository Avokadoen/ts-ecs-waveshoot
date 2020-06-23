import {Vector2D} from './vector2D.model';
import {Movable} from './movable';
import {ComponentIdentifier} from 'naive-ts-ecs';

export class Rectangle implements ComponentIdentifier {

  public static readonly identifier = 'Rectangle';

  constructor(public color: string, public size: Vector2D) {
  }

  identifier(): string {
    return Rectangle.identifier;
  }
}

// TODO: this might be missing taking canvas into consideration
export function isColling(rect1: Rectangle, mov1: Movable, rect2: Rectangle, mov2: Movable): boolean {
  const distanceX = Math.abs(mov1.position.x - mov2.position.x);
  const distanceY = Math.abs(mov1.position.y - mov2.position.y);

  return (distanceX < rect1.size.x && distanceY < rect1.size.y ) ||
    (distanceX < rect2.size.x && distanceY < rect2.size.y);
}
