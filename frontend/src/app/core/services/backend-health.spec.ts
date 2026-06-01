import { TestBed } from '@angular/core/testing';

import { BackendHealth } from './backend-health';

describe('BackendHealth', () => {
  let service: BackendHealth;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BackendHealth);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
