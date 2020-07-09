import {isColling, Rectangle} from './model/rectangle';
import {Movable} from './model/movable';
import {Player} from './model/player.model';
import {fromEvent, timer} from 'rxjs';
import {delay, filter, map} from 'rxjs/operators';
import {magnitude, normalize, scale} from './model/vector2D.model';
import {Bullet} from './model/bullet';
import {EnemyTag} from './model/enemy';
import {UniqueTag} from './model/unique';
import { ScoreTextTag, ScoreText } from './model/score-text';
import { 
  ECSManager, 
  QueryNode, 
  QueryToken, 
  Component, 
  registerComponentType, 
  addComponent, 
  registerSystem,
  removeComponent,
  QueryBuilder, 
  registerEvent
} from 'naive-ts-ecs';

// TODO: enemey and bullet should be using an active and inactive tag instead of removing movable

export class WaveShooterGame {
  public readonly ENEMIES_SPEED = 210;
  public readonly BULLET_SPEED = 500;
  public readonly PLAYER_SPEED = 250;
  public readonly SCORE_TEXT_SPEED = 200;

  public readonly PLAYER_RECT: Rectangle = {
    color: '#3f51b5', 
    size: { x: 20, y: 30 }
  };

  readonly ENEMIES_COUNT = 40;
  readonly BULLET_COUNT = 20;

  public keysDown: string[] = [];
  public manager: ECSManager;

  constructor(public canvas: HTMLCanvasElement) {
    this.manager = new ECSManager();

    // As of 1.4 all components has to be registered before they can be added
    registerComponentType<UniqueTag>(this.manager, {});
    registerComponentType<EnemyTag>(this.manager, {});
    registerComponentType<Bullet>(this.manager, { maxRange: 800 });
    registerComponentType<ScoreText>(this.manager, {
      content: '', 
      fontSize: 30, 
      alpha: 1 
    });
    registerComponentType<ScoreTextTag>(this.manager, {});
    registerComponentType<Player>(this.manager, { score: 0 });
    registerComponentType<Movable>(this.manager, {
      position: {
        x: 0,
        y: 0
      },
      velocity: {
        x: 0,
        y: 0
      },
      speed: 0
    });
    registerComponentType<Rectangle>(this.manager, {
      color: '#ffffff',
      size: { x: 500, y: 500 }
    })

    addComponent<UniqueTag>(this.manager, this.manager.createEntity().entityId);
    for (let i = 0; i < this.ENEMIES_COUNT; i++) {
      const { entityId } = this.manager.createEntity();
      addComponent<EnemyTag>(this.manager, entityId);
      addComponent<Rectangle>(this.manager, entityId, {
        color: '#ff4081', 
        size: { x: 20, y: 30 }
      });
    }

    for (let i = 0; i < this.BULLET_COUNT; i++) {
      const { entityId } = this.manager.createEntity();
      addComponent<Bullet>(this.manager, entityId);
      addComponent<Rectangle>(this.manager, entityId, {
        color: '#ffffff', 
        size: { x: 4, y: 4 }
      });
    }

    for (let i = 0; i < 10; i++) {
      const { entityId } = this.manager.createEntity();
      addComponent<ScoreTextTag>(this.manager, entityId);
    }
    
    {
      const { entityId } = this.manager.createEntity();
      addComponent<Player>(this.manager, entityId);
      addComponent<Movable>(this.manager, entityId, {
        position: {
          x: canvas.width * 0.5 - this.PLAYER_RECT.size.x * 0.5,
          y: canvas.height * 0.5 - this.PLAYER_RECT.size.y * 0.5
        },
        velocity: {
          x: 0,
          y: 0,
        },
        speed: this.PLAYER_SPEED
      });
      addComponent<Rectangle>(this.manager, entityId, {
        color: '#3f51b5', 
        size: { x: 20, y: 30 }
      });
    }

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
      const playerScore = 1000; // TODO:
      return Math.min(playerScore / ceiling, 1);
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
    const drawRectangleSystem = (_: number, rect: Component<Rectangle>, movable: Component<Movable>) => {
      ctx.fillStyle = rect.data.color;
      ctx.fillRect(
        movable.data.position.x, 
        movable.data.position.y, 
        rect.data.size.x, 
        rect.data.size.y
      );
    };

    registerSystem(manager, drawRectangleSystem);
  }

  function rdrawScoreTextSystem(manager: ECSManager, ctx: CanvasRenderingContext2D) {
    const drawScoreTextSystem = (_: number, st: Component<ScoreText>, mov: Component<Movable>) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${st.data.alpha})`; 
      ctx.font = `${st.data.fontSize}px serif`;
      ctx.textAlign = 'center';

      ctx.fillText(st.data.content, mov.data.position.x, mov.data.position.y);
    }

    registerSystem(manager, drawScoreTextSystem);
  }

  function rMoveMovablesSystem(manager: ECSManager) {
    const movableSystem = (deltaTime: number, movable: Component<Movable>) => {
      movable.data.velocity = scale(normalize(movable.data.velocity), movable.data.speed);
      movable.data.position.x += movable.data.velocity.x * deltaTime;
      movable.data.position.y += movable.data.velocity.y * deltaTime;
    };

    registerSystem(manager, movableSystem);
  }

  function rMoveScoreTextSystem(manager: ECSManager) {
    const speedDecay = 80;
    const sizeDecay = 20;
    const alphaDecay = 0.4;

    const moveScoreTextSystem = (deltaTime: number, scoreText: Component<ScoreText>, movable: Component<Movable>) => {
      movable.data.speed -= speedDecay * deltaTime;
      scoreText.data.fontSize += sizeDecay * deltaTime;
      scoreText.data.alpha -= alphaDecay * deltaTime;
     
      if (movable.data.speed < 30) {
        removeComponent<ScoreText>(manager, scoreText.entityId);
        removeComponent<Movable>(manager, movable.entityId);
      }
    };

    registerSystem(manager, moveScoreTextSystem);
  }
}

module PlayerModule {
  export function initialize(game: WaveShooterGame, viewKeysDown: () => string []) {
    rPlayerMoveSystem(game.manager, viewKeysDown);
    rShootBulletEvent(game.manager, game.canvas, game.BULLET_SPEED);
  }

  function rPlayerMoveSystem(manager: ECSManager, viewKeysDown: () => string[]) {
    const playerMoveSystem = (deltaTime: number, _: Component<Player>, movable: Component<Movable>) => {
      const keys = viewKeysDown();

      for (const key of keys) {
        switch (key) {
          case 'w':
            movable.data.velocity.y = -1;
            break;
          case 'a':
            movable.data.velocity.x = -1;
            break;
          case 's':
            movable.data.velocity.y = 1;
            break;
          case 'd':
            movable.data.velocity.x = 1;
            break;
        }
      }
      movable.data.velocity = scale(normalize(movable.data.velocity), movable.data.speed);
      movable.data.position.x += movable.data.velocity.x * deltaTime;
      movable.data.position.y += movable.data.velocity.y * deltaTime;

      movable.data.velocity.x = 0;
      movable.data.velocity.y = 0;
    };

    registerSystem(manager, playerMoveSystem);
  }

  function rShootBulletEvent(manager: ECSManager, canvas: HTMLCanvasElement, bulletSpeed: number) {

    const bulletQuery = new QueryBuilder().identifier('Bullet')
      .token(QueryToken.NOT)
      .identifier('Movable')
      .build();

    const shootBulletEvent = (event: Event, movable: Component<Movable>, rectangle: Component<Rectangle>) => {
      const e = event as MouseEvent;

      const clickDelta = {
        x: e.clientX - (movable.data.position.x + rectangle.data.size.x * 0.5) - canvas.offsetLeft,
        y: e.clientY - (movable.data.position.y + rectangle.data.size.y * 0.5) - canvas.offsetTop
      };

      const shootDirection = normalize(clickDelta);

      const bulletSpawn = scale(shootDirection, 20);

      // TODO: query in game loop :( (find alternative)
      const bulletId = manager.queryEntities(bulletQuery).entities[0].id;
      // TODO: add a bulle spawn tag instead as adding a movable will invalidate the most common queries in the game
      addComponent<Movable>(manager, bulletId, {
        position: {
          x: movable.data.position.x + rectangle.data.size.x * 0.5 + bulletSpawn.x,
          y: movable.data.position.y + rectangle.data.size.y * 0.5 + bulletSpawn.y,
        },
        velocity: shootDirection,
        speed: bulletSpeed
      });
    };

    const onUserClick = registerEvent(manager, shootBulletEvent)
    fromEvent(canvas, 'click').subscribe(e => manager.onEvent(onUserClick, e));
  }
}

module EnemyModule {
  export function initialize(game: WaveShooterGame, difficultyScaling: () => number) {
    rTargetPlayerSystem(game.manager);
    rSpawnEnemySystem(game.manager, game.canvas, game.ENEMIES_SPEED, difficultyScaling);
  }

  function rTargetPlayerSystem(manager: ECSManager) {
    const query: QueryNode = {
        token: QueryToken.AND,
        leftChild: {
            typeStr: 'EnemyTag'
        },
        rightChild: {
            token: QueryToken.OR,
            leftChild: {
                typeStr: 'Movable'
            },
            rightChild: {
                token: QueryToken.SHARED,
                leftChild: {
                    token: QueryToken.AND,
                    leftChild: {
                        typeStr: 'Player'
                    },
                    rightChild: {
                        typeStr: 'Movable'
                    }
                }
            }
        }
    };
    const targetPlayerSystem = (
      _: number,
      _enemy: Component<EnemyTag>,
      eMovable: Component<Movable>,
      _player: Component<Player>[],
      pMovable: Component<Movable>[] 
      ) => {
        eMovable.data.velocity = {
              x: pMovable[0].data.position.x - eMovable.data.position.x,
              y: pMovable[0].data.position.y - eMovable.data.position.y
        };
    };

    manager.registerSystemWithEscQuery(targetPlayerSystem, query);
  }

  function rSpawnEnemySystem(manager: ECSManager, canvas: HTMLCanvasElement, enemySpeed: number, difficultyScaling: () => number) {
    const enemyQuery: QueryNode = {
      token: QueryToken.NOT,
      leftChild: {
        typeStr: 'EnemyTag'
      },
      rightChild: {
        typeStr: 'Movable'
      }
    };


    const spawnEnemySystem = (_e : Event, _u: Component<UniqueTag>) => {
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
        addComponent<Movable>(manager, enemyId, {
          position: {
            x: xSpawn,
            y: ySpawn,
          },
          velocity: { x: 0, y: 0},
          speed: enemySpeed
        });
      }
    };

    const spawnEnemyEvent = timer(2000, 1000).pipe(
      delay(Math.random() * (3 - (3.5 * difficultyScaling())))
    );

    
    const onSpawnEnemy = registerEvent(manager, spawnEnemySystem);
    spawnEnemyEvent.subscribe(() => manager.onEvent(onSpawnEnemy, null));
  }
}

module BulletModule {

  export function initialize(manager: ECSManager) {
    rDespawnBulletSystem(manager);
    rBulletHitSystem(manager);
  }

  function rDespawnBulletSystem(manager: ECSManager) {
    // currently no typesafe option for querybuilder
    const query: QueryNode = {
      token: QueryToken.AND,
      leftChild: {
        typeStr: 'Bullet'
      },
      rightChild: {
        token: QueryToken.OR,
        leftChild: {
          typeStr: 'Movable'
        },
        rightChild: {
          token: QueryToken.SHARED,
          leftChild: {
            token: QueryToken.AND,
            leftChild: {
              typeStr: 'Player'
            },
            rightChild: {
              typeStr: 'Movable'
            }
          }
        }
      }
    };

    const despawnBulletsSystem = (_: number, 
      bullet: Component<Bullet>, 
      bMovable: Component<Movable>, 
      player: Component<Player>[], 
      pMovable: Component<Movable>[]) => {

      if (Math.abs(magnitude(bMovable.data.position) - magnitude(pMovable[0].data.position)) > bullet.data.maxRange) {
        removeComponent<Movable>(manager, bMovable.entityId);
      }
    };

    manager.registerSystemWithEscQuery(despawnBulletsSystem, query);
  }

  function rBulletHitSystem(manager: ECSManager) {
    const query: QueryNode = {
      token: QueryToken.AND,
      leftChild: {
        typeStr: 'Rectangle'
      },
      rightChild: {
        token: QueryToken.AND,
        leftChild: {
          typeStr: 'Movable'
        },
        rightChild: {
          token: QueryToken.OR,
          leftChild: {
            typeStr: 'Bullet'
          },
          rightChild: {
              token: QueryToken.SHARED,
              leftChild: {
                token: QueryToken.AND,
                leftChild: {
                  typeStr: 'Rectangle'
                },
                rightChild: {
                  token: QueryToken.AND,
                  leftChild: {
                    typeStr: 'Movable'
                  },
                  rightChild: {
                    token: QueryToken.OR,
                    leftChild: {
                      typeStr: 'EnemyTag'
                    },
                    rightChild: {
                      typeStr: 'Player'
                    }
                  }
                }
              }
          }
        }
      }
    };

    const textQuery: QueryNode = {
      token: QueryToken.NOT,
      leftChild: {
        typeStr: 'ScoreTextTag'
      },
      rightChild: {
        typeStr: 'ScoreText'
      }
    }

    const bulletHitSystem = (
        _: number,
        bRectangle: Component<Rectangle>,
        bMovable: Component<Movable>,
        _bullet: Component<Bullet>,
        rectangles: Component<Rectangle>[],
        movable: Component<Movable>[],
        enemyTag: Component<EnemyTag>[],
        player: Component<Player>[],
       ) => {

        if (!enemyTag || !player) {
          return;
        }

        for (let [index, enemy] of enemyTag.entries()) {
          const eRectangle = rectangles[index]; // this just happens to align, otherwise a find id would be a safer approach
          const eMovable = movable[index]; // same for this
          if (isColling(bRectangle.data, bMovable.data, eRectangle.data, eMovable.data)) {
            player[0].data.score += 10;
            removeComponent<Movable>(manager, bMovable.entityId);
            removeComponent<Movable>(manager, eMovable.entityId);

            
            // TODO: query in game loop :( (find alternative)
            const textId = manager.queryEntities(textQuery)?.entities[0]?.id;
            if (!isNaN(textId)) {
              const pMovable = movable[movable.length-1].data as Movable;
              
              addComponent<ScoreText>(manager, textId, { content: `${player[0].data.score}`, fontSize: 30, alpha: 1 })
              addComponent<Movable>(
                manager, 
                textId, 
                { 
                  position: {
                    x: pMovable.position.x, y: pMovable.position.y 
                  }, 
                  velocity: {x: 0, y: -1}, 
                  speed: 200
                });
            }
          }
      }
    };

    manager.registerSystemWithEscQuery(bulletHitSystem, query);
  }
  
}