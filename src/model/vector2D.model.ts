export interface Vector2D {
  x: number;
  y: number;
}

export function magnitude(vector: Vector2D): number {
  return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
}

export function normalize(vector: Vector2D): Vector2D {
  const myMagnitude = magnitude(vector);
  if (myMagnitude === 0) {
    return {
      x: 0,
      y: 0
    };
  }

  return {
    x: vector.x / myMagnitude,
    y: vector.y / myMagnitude
  };
}

export function scale(vector: Vector2D, value: number): Vector2D {
  return {
    x: vector.x * value,
    y: vector.y * value,
  };
}
