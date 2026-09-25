import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Review } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  constructor(private http: HttpClient) {}

  latest(): Observable<Review[]> {
    return this.http.get<Review[]>(`${environment.apiBaseUrl}/reviews`);
  }

  create(rating: number, comment: string): Observable<Review> {
    return this.http.post<Review>(`${environment.apiBaseUrl}/reviews`, { rating, comment });
  }
}
