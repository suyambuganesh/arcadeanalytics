import { Injectable } from '@angular/core';
import { JhiLanguageService } from 'ng-jhipster';
import { SessionStorageService } from 'ngx-webstorage';
import { Observable, Subject } from 'rxjs';
import { AccountService } from './account.service';
import { JhiTrackerService } from '../tracker/tracker.service'; // Barrel doesn't work here. No idea why!
import { HttpResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class Principal {
    private userIdentity: any;
    private authenticated = false;
    private authenticationState = new Subject<any>();

    constructor(
        private languageService: JhiLanguageService,
        private sessionStorage: SessionStorageService,
        private account: AccountService,
        private trackerService: JhiTrackerService
    ) {}

    authenticate(identity) {
        this.userIdentity = identity;
        this.authenticated = identity !== null;
        this.authenticationState.next(this.userIdentity);
    }

    hasAnyAuthority(authorities: string[]): Promise<boolean> {
        return Promise.resolve(this.hasAnyAuthorityDirect(authorities));
    }

    hasAnyAuthorityDirect(authorities: string[]): boolean {
        if (!this.authenticated || !this.userIdentity || !this.userIdentity.authorities) {
            return false;
        }

        for (let i = 0; i < authorities.length; i++) {
            if (this.userIdentity.authorities.includes(authorities[i])) {
                return true;
            }
        }

        return false;
    }

    hasAuthority(authority: string): Promise<boolean> {
        if (!this.authenticated) {
            return Promise.resolve(false);
        }

        return this.identity().then((id) => {
            return Promise.resolve(id.authorities && id.authorities.includes(authority));
        }, () => {
            return Promise.resolve(false);
        });
    }

    identity(force?: boolean): Promise<any> {
        if (force === true) {
            this.userIdentity = undefined;
        }

        // check and see if we have retrieved the userIdentity data from the server.
        // if we have, reuse it by immediately resolving
        if (this.userIdentity) {
            return Promise.resolve(this.userIdentity);
        }

        // retrieve the userIdentity data from the server, update the identity object, and then resolve.
        return this.account
            .get()
            .toPromise()
            .then((response: HttpResponse<any>) => {
                const account = response.body;
                if (account) {
                    this.userIdentity = account;
                    this.authenticated = true;
                    this.trackerService.connect();

                    // After retrieve the account info, the language will be changed to
                    // the user's preferred language configured in the account setting
                    const langKey = this.sessionStorage.retrieve('locale') || this.userIdentity.langKey;
                    this.languageService.changeLanguage(langKey);
                } else {
                    this.userIdentity = null;
                    this.authenticated = false;
                }
                this.authenticationState.next(this.userIdentity);
                return this.userIdentity;
            }).catch((err) => {
                if (this.trackerService.stompClient && this.trackerService.stompClient.connected) {
                    this.trackerService.disconnect();
                }
                this.userIdentity = null;
                this.authenticated = false;
                this.authenticationState.next(this.userIdentity);
                return null;
            });
    }

    isAuthenticated(): boolean {
        return this.authenticated;
    }

    isIdentityResolved(): boolean {
        return this.userIdentity !== undefined;
    }

    getAuthenticationState(): Observable<any> {
        return this.authenticationState.asObservable();
    }

    getImageUrl(): string {
        return this.isIdentityResolved() ? this.userIdentity.imageUrl : null;
    }
}
