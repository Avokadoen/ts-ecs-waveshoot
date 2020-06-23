import {ComponentIdentifier} from 'naive-ts-ecs';

export class Unique implements ComponentIdentifier {
  public static readonly identifier = 'Unique';

  identifier(): string {
    return Unique.identifier;
  }
}
