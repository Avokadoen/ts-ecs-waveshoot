import {Vector2D} from './vector2D.model';
import {ComponentIdentifier} from 'naive-ts-ecs';

export class Player implements ComponentIdentifier {

  public static readonly identifier = 'Player';

  constructor() {
  }

  identifier(): string {
    return Player.identifier;
  }
}
