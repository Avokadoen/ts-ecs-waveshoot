import {ComponentIdentifier} from 'naive-ts-ecs';

export class Enemy implements ComponentIdentifier {
  public static readonly identifier = 'Enemy';

  identifier(): string {
    return Enemy.identifier;
  }
}
