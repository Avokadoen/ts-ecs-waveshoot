import { ComponentIdentifier } from "naive-ts-ecs";

export class ScoreText implements ComponentIdentifier {
    public static readonly identifier = 'ScoreText';

    constructor(
        public content: string, 
        public fontSize: number, 
        public alpha: number
        ) {}

    identifier(): string {
        return ScoreText.identifier;
    }
}

export class ScoreTextTag implements ComponentIdentifier {
    public static readonly identifier = 'ScoreTextTag';

    identifier(): string {
        return ScoreTextTag.identifier;
    }
}