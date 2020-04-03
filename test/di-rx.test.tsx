import { act, render } from '@testing-library/react';
import React, { Component } from 'react';
import { BehaviorSubject, interval, Subject } from 'rxjs';
import { scan, startWith } from 'rxjs/operators';

import {
  IDisposable,
  Provide,
  Provider,
  useCollection,
  useDependency,
  useDependencyValue,
  useUpdateBinder
} from '../src';

describe('di-rx', () => {
  it('should demo works with RxJS', async () => {
    class CounterService {
      counter$ = interval(1000).pipe(
        startWith(0),
        scan((acc) => acc + 1)
      );
    }

    @Provide([CounterService])
    class App extends Component {
      render() {
        return <Display />;
      }
    }

    function Display() {
      const counter = useDependency(CounterService);
      const value = useDependencyValue(counter!.counter$, 0);

      return <div>{value}</div>;
    }

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('0');

    await act(
      () => new Promise<undefined>((res) => setTimeout(() => res(), 3100))
    );
    expect(container.firstChild!.textContent).toBe('3');
  });

  it('should use default value in BehaviourSubject', async () => {
    class CounterService implements IDisposable {
      public counter$: BehaviorSubject<number>;
      private number: number;
      private loop?: number;

      constructor() {
        this.number = 5;
        this.counter$ = new BehaviorSubject(this.number);
        this.loop = (setInterval(() => {
          this.number += 1;
          this.counter$.next(this.number);
        }, 1000) as any) as number;
      }

      dispose(): void {
        clearTimeout(this.loop!);
      }
    }

    function App() {
      const collection = useCollection([CounterService]);

      return (
        <Provider collection={collection}>
          <Child />
        </Provider>
      );
    }

    function Child() {
      const counterService = useDependency(CounterService);
      const count = useDependencyValue(counterService.counter$);

      return <div>{count}</div>;
    }

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('5');

    await act(
      () => new Promise<undefined>((res) => setTimeout(() => res(), 3200))
    );
    expect(container.firstChild!.textContent).toBe('8');
  });

  it('should not trigger unnecesary re-render when handled correctly', async () => {
    let childRenderCount = 0;

    class CounterService {
      counter$ = interval(1000).pipe(
        startWith(0),
        scan((acc) => acc + 1)
      );
    }

    function App() {
      const collection = useCollection([CounterService]);

      return (
        <Provider collection={collection}>
          <Parent />
        </Provider>
      );
    }

    function Parent() {
      const counterService = useDependency(CounterService);
      const count = useDependencyValue(counterService.counter$, 0);

      return <Child count={count} />;
    }

    function Child(props: { count?: number }) {
      childRenderCount += 1;
      return <div>{props.count}</div>;
    }

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('0');
    expect(childRenderCount).toBe(1);

    await act(
      () => new Promise<undefined>((res) => setTimeout(() => res(), 3100))
    );
    expect(container.firstChild!.textContent).toBe('3');
    expect(childRenderCount).toBe(4);
  });

  it('should update whenever `useUpdateBinder` emits', async () => {
    class CounterService implements IDisposable {
      public number = 0;
      public updater$ = new Subject<void>();

      private loop?: number;

      constructor() {
        this.loop = (setInterval(() => {
          this.number += 1;
          this.updater$.next();
        }, 1000) as any) as number;
      }

      dispose(): void {
        clearTimeout(this.loop!);
      }
    }

    function App() {
      const collection = useCollection([CounterService]);

      return (
        <Provider collection={collection}>
          <Child />
        </Provider>
      );
    }

    function Child() {
      const counterService = useDependency(CounterService);

      useUpdateBinder(counterService.updater$);

      return <div>{counterService.number}</div>;
    }

    const { container } = render(<App />);
    expect(container.firstChild!.textContent).toBe('0');

    await act(
      () => new Promise<undefined>((res) => setTimeout(() => res(), 3200))
    );
    expect(container.firstChild!.textContent).toBe('3');
  });
});