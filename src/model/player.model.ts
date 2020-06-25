import {ComponentIdentifier} from 'naive-ts-ecs';

export class Player implements ComponentIdentifier {

  public static readonly identifier = 'Player';

  constructor(public score: number) {
  }

  identifier(): string {
    return Player.identifier;
  }
}
