import {isColling, Rectangle} from './model/rectangle';
import {Movable} from './model/movable';
import {Player} from './model/player.model';
import {fromEvent, timer} from 'rxjs';
import {delay, filter, map} from 'rxjs/operators';
import {magnitude, normalize, scale} from './model/vector2D.model';
import {Component, ECSManager, EscQuery, QueryToken} from 'naive-ts-ecs';
import {Bullet} from './model/bullet';
import {Enemy} from './model/enemy';
import {Unique} from './model/unique';
import { ScoreTextTag, ScoreText } from './model/score-text';

export class WaveShooterGame {
  public readonly ENEMIES_SPEED = 210;
  public readonly BULLET_SPEED = 500;
  public readonly PLAYER_SPEED = 250;
  public readonly SCORE_TEXT_SPEED = 200;

  public readonly ENEMY_ATTR = new Rectangle('#ff4081', { x: 20, y: 30 });
  public readonly PLAYER_ATTR = new Rectangle('#3f51b5', { x: 20, y: 30 });
  public readonly BULLET_ATTR = new Rectangle('#ffffff', { x: 4, y: 4 });

  readonly ENEMIES_COUNT = 40;
  readonly BULLET_COUNT = 20;

  public keysDown: string[] = [];
  public manager: ECSManager;

  // we keep a component reference (this is a nono)
  playerRef: Player;

  constructor(public canvas: HTMLCanvasElement) {
    this.manager = new ECSManager();

    this.manager.createEntity().addComponent(new Unique());

    const enemyComp = new Enemy();
    for (let i = 0; i < this.ENEMIES_COUNT; i++) {
      this.manager.createEntity()
        .addComponent(enemyComp)
        .addComponent(this.ENEMY_ATTR);
    }

    const bulletComp = new Bullet(500);
    for (let i = 0; i < this.BULLET_COUNT; i++) {
      this.manager.createEntity()
        .addComponent(bulletComp)
        .addComponent(this.BULLET_ATTR);
    }

    const scoreTextTagComp = new ScoreTextTag();
    for (let i = 0; i < 10; i++) {
      this.manager.createEntity()
        .addComponent(scoreTextTagComp)
    }
    
    this.playerRef = new Player(0);

    const playerMov = new Movable(
      {
        x: canvas.width * 0.5 - this.PLAYER_ATTR.size.x * 0.5,
        y: canvas.height * 0.5 - this.PLAYER_ATTR.size.y * 0.5
      },
      {
        x: 0,
        y: 0,
      },
      this.PLAYER_SPEED
    );

    this.manager.createEntity()
      .addComponent(this.playerRef)
      .addComponent(playerMov)
      .addComponent(this.PLAYER_ATTR);

    fromEvent(window, 'keydown').pipe(
      map(e => e as KeyboardEvent),
      filter((e) =>
        e.key === 'w'
        || e.key === 'a'
        || e.key === 's'
        || e.key === 'd'
      )
    ).subscribe(e => this.keysDown.push(e.key));

    fromEvent(window, 'keyup').pipe(
      map(e => e as KeyboardEvent),
      filter((e) =>
        e.key === 'w'
        || e.key === 'a'
        || e.key === 's'
        || e.key === 'd'
      )
    ).subscribe(e => this.keysDown = this.keysDown.filter(k => k !== e.key));
  }

  initialize(): void {
    UtilityModule.initialize(this.manager, this.canvas);
    BulletModule.initialize(this.manager);

    const difficultyScaling = () => {
      const ceiling = 2000;
      return Math.max(this.playerRef.score / ceiling, 1);
    };
    EnemyModule.initialize(this, difficultyScaling);

    const viewKeysDown = () => {
      return this.keysDown
    };
    PlayerModule.initialize(this, viewKeysDown);
  }

  dispatch(): void {
    this.manager.dispatch();
  }
}

module UtilityModule {
  export function initialize(manager: ECSManager, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');

    rDrawEntitySystem(manager, ctx);
    rdrawScoreTextSystem(manager, ctx);

    rMoveMovablesSystem(manager);
    rMoveScoreTextSystem(manager);
  }

  function rDrawEntitySystem(manager: ECSManager, ctx: CanvasRenderingContext2D) {
    const query: EscQuery = [
      {
        componentIdentifier: Rectangle.identifier,
        token: QueryToken.FIRST,
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      }
    ];

    const drawRectangleSystem = (_: number, args: Component<object>[]) => {
      const rectangle = args[0].data as Rectangle;
      const movable = args[1].data as Movable;

      ctx.fillStyle = rectangle.color;
      ctx.fillRect(movable.position.x, movable.position.y, rectangle.size.x, rectangle.size.y);
    };

    manager.registerSystem(drawRectangleSystem, query);
  }

  function rdrawScoreTextSystem(manager: ECSManager, ctx: CanvasRenderingContext2D) {
    const query: EscQuery = [
      {
        componentIdentifier: ScoreText.identifier,
        token: QueryToken.FIRST,
      },
      {
        componentIdentifier: 'Movable',
        token: QueryToken.AND
      }
    ];

    const drawScoreTextSystem = (_: number, args: Component<object>[]) => {
      const scoreText = args[0].data as ScoreText;
      const movable = args[1].data as Movable;

      ctx.fillStyle = `rgba(255, 255, 255, ${scoreText.alpha})`; 
      ctx.font = `${scoreText.fontSize}px serif`;
      ctx.textAlign = 'center';

      ctx.fillText(scoreText.content, movable.position.x, movable.position.y);
    }

    manager.registerSystem(drawScoreTextSystem, query);
  }

  function rMoveMovablesSystem(manager: ECSManager) {
    const query: EscQuery = [
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Player.identifier,
        token: QueryToken.AND_NOT
      }
    ];

    const movableSystem = (deltaTime: number, args: Component<object>[]) => {
      const movable = args[0].data as Movable;

      movable.velocity = scale(normalize(movable.velocity), movable.speed);
      movable.position.x += movable.velocity.x * deltaTime;
      movable.position.y += movable.velocity.y * deltaTime;
    };

    manager.registerSystem(movableSystem, query);
  }

  function rMoveScoreTextSystem(manager: ECSManager) {
    const query: EscQuery = [
      {
        componentIdentifier: ScoreText.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      }
    ];

    const speedDecay = 80;
    const sizeDecay = 20;
    const alphaDecay = 0.4;

    const moveScoreTextSystem = (deltaTime: number, args: Component<object>[]) => {
      const scoreText = args[0].data as ScoreText;
      const movable = args[1].data as Movable;

      movable.speed -= speedDecay * deltaTime;
      scoreText.fontSize += sizeDecay * deltaTime;
      scoreText.alpha -= alphaDecay * deltaTime;
     
      if (movable.speed < 30) {
        manager.removeComponent(args[0].entityId, ScoreText.identifier);
        manager.removeComponent(args[1].entityId, Movable.identifier);
        return true;
      }

      return false;
    };

    manager.registerSystem(moveScoreTextSystem, query);
  }
}

module PlayerModule {
  export function initialize(game: WaveShooterGame, viewKeysDown: () => string []) {
    rPlayerMoveSystem(game.manager, viewKeysDown);
    rShootBulletEvent(game.manager, game.canvas, game.BULLET_SPEED);
  }

  function rPlayerMoveSystem(manager: ECSManager, viewKeysDown: () => string[]) {
    const query: EscQuery = [
      {
        componentIdentifier: Player.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      }
    ];

    const playerMoveSystem = (deltaTime: number, args: Component<object>[]) => {
      const _ = args[0].data as Player;
      const movable = args[1].data as Movable;

      const keys = viewKeysDown();

      for (const key of keys) {
        switch (key) {
          case 'w':
            movable.velocity.y = -1;
            break;
          case 'a':
            movable.velocity.x = -1;
            break;
          case 's':
            movable.velocity.y = 1;
            break;
          case 'd':
            movable.velocity.x = 1;
            break;
        }
      }
      movable.velocity = scale(normalize(movable.velocity), movable.speed);
      movable.position.x += movable.velocity.x * deltaTime;
      movable.position.y += movable.velocity.y * deltaTime;

      movable.velocity.x = 0;
      movable.velocity.y = 0;
    };

    manager.registerSystem(playerMoveSystem, query);
  }

  function rShootBulletEvent(manager: ECSManager, canvas: HTMLCanvasElement, bulletSpeed: number) {
    {
      const bulletQuery: EscQuery = [
        {
          componentIdentifier: Bullet.identifier,
          token: QueryToken.FIRST
        },
        {
          componentIdentifier: Movable.identifier,
          token: QueryToken.AND_NOT
        },
      ];

      const shootBulletEvent = (event: Event, args: Component<object>[]) => {
        // const player = args[0].data as Player;
        const movable = args[1].data as Movable;
        const rectangle = args[2].data as Rectangle;

        const e = event as MouseEvent;

        const clickDelta = {
          x: e.clientX - (movable.position.x + rectangle.size.x * 0.5) - canvas.offsetLeft,
          y: e.clientY - (movable.position.y + rectangle.size.y * 0.5) - canvas.offsetTop
        };

        const shootDirection = normalize(clickDelta);

        const bulletSpawn = scale(shootDirection, 20);

        // TODO: query in game loop :( (find alternative)
        const bulletId = manager.queryEntities(bulletQuery).entities[0].id;
        manager.addComponent(bulletId, 
          new Movable(
            {
              x: movable.position.x + rectangle.size.x * 0.5 + bulletSpawn.x,
              y: movable.position.y + rectangle.size.y * 0.5 + bulletSpawn.y,
            },
            shootDirection,
            bulletSpeed
          )
        );
      };

      const query: EscQuery = [
        {
          componentIdentifier: 'Player',
          token: QueryToken.FIRST
        },
        {
          componentIdentifier: 'Movable',
          token: QueryToken.AND
        },
        {
          componentIdentifier: 'Rectangle',
          token: QueryToken.AND
        }
      ];

      const onUserClick = manager.registerEvent(shootBulletEvent, query);
      fromEvent(canvas, 'click').subscribe(e => manager.onEvent(onUserClick, e));
    }
  }
}

module EnemyModule {
  export function initialize(game: WaveShooterGame, difficultyScaling: () => number) {
    rTargetPlayerSystem(game.manager);
    rSpawnEnemySystem(game.manager, game.canvas, game.ENEMIES_SPEED, difficultyScaling);
  }

  function rTargetPlayerSystem(manager: ECSManager) {
    const enemyQuery: EscQuery = [
      {
        componentIdentifier: Enemy.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      },
      {
        componentIdentifier: Player.identifier,
        token: QueryToken.SHARED
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      },
    ];

    const targetPlayerSystem = (_: number, args: Component<object>[], sharedArgs: Component<object>[]) => {
      // const enemy = args[0].data as Enemy;
      const eMovable = args[1].data as Movable;
      // const player = sharedArgs[0].data as Player;
      const pMovable = sharedArgs[1].data as Movable;

      eMovable.velocity = {
            x: pMovable.position.x - eMovable.position.x,
            y: pMovable.position.y - eMovable.position.y
      };
    };

    manager.registerSystem(targetPlayerSystem, enemyQuery);
  }

  function rSpawnEnemySystem(manager: ECSManager, canvas: HTMLCanvasElement, enemySpeed: number, difficultyScaling: () => number) {
    const enemyQuery: EscQuery = [
      {
        componentIdentifier: Enemy.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND_NOT
      }
    ];


    const spawnEnemySystem = (_: Event, args: Component<object>[]) => {
      // const Enemy = args[0].data as Enemy;

      const xIsSmooth = (Math.random() > 0.5);
      let xSpawn: number;
      let ySpawn: number;
      if (xIsSmooth) {
        xSpawn = Math.random() * canvas.width;
        const yOffset = Math.random() * 200;
        ySpawn = (Math.random() > 0.5) ? canvas.height + yOffset : -yOffset;
      } else {
        ySpawn = Math.random() * canvas.height;
        const yOffset = Math.random() * 200;
        xSpawn = (Math.random() > 0.5) ? canvas.width + yOffset : -yOffset;
      }

      const enemyId = manager.queryEntities(enemyQuery).entities[0]?.id;

      if (!isNaN(enemyId)) {
        manager.addComponent(enemyId, new Movable(
          {
            x: xSpawn,
            y: ySpawn,
          },
          { x: 0, y: 0},
          enemySpeed
        ));
      }
    };

    const spawnEnemyEvent = timer(2000, 1000).pipe(
      delay(Math.random() * (3 - (3.5 * difficultyScaling())))
    );

    const enemySpawnQuery: EscQuery = [
      {
        componentIdentifier: Unique.identifier,
        token: QueryToken.FIRST
      }
    ];
    const onSpawnEnemy = manager.registerEvent(spawnEnemySystem, enemySpawnQuery);
    spawnEnemyEvent.subscribe(() => manager.onEvent(onSpawnEnemy, null));
  }
}

module BulletModule {

  export function initialize(manager: ECSManager) {
    rDespawnBulletSystem(manager);
    rBulletHitSystem(manager);
  }

  function rDespawnBulletSystem(manager: ECSManager) {
    const query: EscQuery = [
      {
        componentIdentifier: Bullet.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      },
      {
        componentIdentifier: Player.identifier,
        token: QueryToken.SHARED
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      },
    ];

    const despawnBulletsSystem = (_: number, args: Component<object>[], sharedArgs: Component<object>[]) => {
      const bullet = args[0].data as Bullet;
      if (!args[1]) {
        return;
      }
      const bMovable = args[1].data as Movable;
      // const player = sharedArgs[0].data as Player;
      const pMovable = sharedArgs[1].data as Movable;

      if (Math.abs(magnitude(bMovable.position) - magnitude(pMovable.position)) > bullet.maxRange) {
        manager.removeComponent(args[0].entityId, Movable.identifier);
      }
    };

    manager.registerSystem(despawnBulletsSystem, query);
  }

  function rBulletHitSystem(manager: ECSManager) {
    const query: EscQuery = [
      {
        componentIdentifier: Rectangle.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      },
      {
        componentIdentifier: Bullet.identifier,
        token: QueryToken.AND
      },
      {
        componentIdentifier: Rectangle.identifier,
        token: QueryToken.SHARED
      },
      {
        componentIdentifier: Movable.identifier,
        token: QueryToken.AND
      },
      {
        componentIdentifier: Enemy.identifier,
        token: QueryToken.AND
      },
      {
        componentIdentifier: Player.identifier,
        token: QueryToken.OR
      },
    ];

    const textQuery: EscQuery = [
      {
        componentIdentifier: ScoreTextTag.identifier,
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: ScoreText.identifier,
        token: QueryToken.AND_NOT
      },
    ];

    const bulletHitSystem = (_: number, args: Component<object>[], sharedArgs: Component<object>[]) => {
      const bRect = args[0].data as Rectangle;
      if (!args[1]) {
        return;
      }
      const bMov = args[1].data as Movable;
      const player = sharedArgs[sharedArgs.length-1].data as Player;

      for (let i = 0; i < sharedArgs.length - 3; i += 3) {
        const enemyRect = sharedArgs[i].data as Rectangle;
        const enemyMov = sharedArgs[i + 1].data as Movable;

        if (isColling(bRect, bMov, enemyRect, enemyMov)) {
          player.score += 10;
          manager.removeComponent(sharedArgs[i + 1].entityId, Movable.identifier);
          manager.removeComponent(args[1].entityId, Movable.identifier);

          // TODO: query in game loop :( (find alternative)
          const textId = manager.queryEntities(textQuery)?.entities[0]?.id;
          if (!isNaN(textId)) {
            const pMovable = sharedArgs[sharedArgs.length-2].data as Movable;
            
            manager.addComponent(textId, new ScoreText(`${player.score}`, 30, 1))
            .addComponent(new Movable({ x: pMovable.position.x, y: pMovable.position.y }, {x: 0, y: -1}, 200));
          }

          return true;
        }
      }

      return false;
    };

    manager.registerSystem(bulletHitSystem, query);
  }
  
}