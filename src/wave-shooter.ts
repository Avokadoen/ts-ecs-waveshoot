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

export class WaveShooterGame {
  public readonly ENEMIES_SPEED = 210;
  public readonly BULLET_SPEED = 500;
  public readonly PLAYER_SPEED = 250;

  public readonly ENEMY_ATTR = new Rectangle('#ff4081', { x: 20, y: 30 });
  public readonly PLAYER_ATTR = new Rectangle('#3f51b5', { x: 20, y: 30 });
  public readonly BULLET_ATTR = new Rectangle('#ffffff', { x: 4, y: 4 });

  readonly ENEMIES_COUNT = 40;
  readonly BULLET_COUNT = 20;

  playerScore: number;

  public keysDown: string[] = [];

  public manager: ECSManager;

  public difficultyScaling(): number {
    const ceiling = 2000;
    return Math.max(this.playerScore / ceiling, 1);
  }

  public viewKeysDown(): string[] {
    return this.keysDown
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.manager = new ECSManager();

    this.playerScore = 0;

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

    
    const player = new Player();

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
      .addComponent(player)
      .addComponent(playerMov)
      .addComponent(this.PLAYER_ATTR);

    UtilityModule.initialize(this.manager);
    BulletModule.initialize(this.manager);

    EnemyModule.initialize(this, canvas);
    PlayerModule.initialize(this, canvas);

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

  dispatch(): void {
    this.manager.dispatch();
  }
}

module UtilityModule {
  export function initialize(manager: ECSManager) {
    rDrawEntitySystem(manager);
    rMoveMovablesSystem(manager);
  }

  function rDrawEntitySystem(manager: ECSManager) {
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


    const ctx = this.canvas.getContext('2d');
    const drawRectangleSystem = (_: number, args: Component<any>[]) => {
      const rectangle = args[0].data as Rectangle;
      const movable = args[1].data as Movable;

      ctx.fillStyle = rectangle.color;
      ctx.fillRect(movable.position.x, movable.position.y, rectangle.size.x, rectangle.size.y);
    };

    manager.registerSystem(drawRectangleSystem, query);
  }

  function rMoveMovablesSystem(manager: ECSManager) {
    const query: EscQuery = [
      {
        componentIdentifier: 'Movable',
        token: QueryToken.FIRST
      },
      {
        componentIdentifier: 'Player',
        token: QueryToken.AND_NOT
      }
    ];

    const movableSystem = (deltaTime: number, args: Component<any>[]) => {
      const movable = args[0].data as Movable;

      movable.velocity = scale(normalize(movable.velocity), movable.speed);
      movable.position.x += movable.velocity.x * deltaTime;
      movable.position.y += movable.velocity.y * deltaTime;
    };

    manager.registerSystem(movableSystem, query);
  }
}

module PlayerModule {
  export function initialize(game: WaveShooterGame, canvas: HTMLCanvasElement) {
    rPlayerMoveSystem(game.manager, game.viewKeysDown);
    rShootBulletEvent(game.manager, canvas, game.BULLET_SPEED);
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

    const playerMoveSystem = (deltaTime: number, args: Component<any>[]) => {
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

      const shootBulletEvent = (event: Event, args: Component<any>[]) => {
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
  export function initialize(game: WaveShooterGame, canvas: HTMLCanvasElement) {
    rTargetPlayerSystem(game.manager);
    rSpawnEnemySystem(game.manager, canvas, game.ENEMIES_SPEED, game.difficultyScaling);
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


    const spawnEnemySystem = (_: Event, args: Component<any>[]) => {
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
    ];

    const bulletHitSystem = (_: number, args: Component<object>[], sharedArgs: Component<object>[]) => {
      const bRect = args[0].data as Rectangle;
      if (!args[1]) {
        return;
      }
      const bMov = args[1].data as Movable;

      for (let i = 0; i < sharedArgs.length; i += 3) {
        const enemyRect = sharedArgs[i].data as Rectangle;
        const enemyMov = sharedArgs[i + 1].data as Movable;

        if (isColling(bRect, bMov, enemyRect, enemyMov)) {
          manager.removeComponent(sharedArgs[i + 1].entityId, Movable.identifier);
          manager.removeComponent(args[1].entityId, Movable.identifier);
          return true;
        }
      }

      return false;
    };

    manager.registerSystem(bulletHitSystem, query);
  }
  
}