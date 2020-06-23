import {ComponentIdentifier} from 'naive-ts-ecs';

export class Bullet implements ComponentIdentifier {
  public static readonly identifier = 'Bullet';

  constructor(public maxRange: number) {
  }

  identifier(): string {
    return Bullet.identifier;
  }
}
