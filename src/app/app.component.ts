import { Component, ChangeDetectionStrategy, ElementRef } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  title = 'app works!';
  public doSomething(event: any) {
    var target = event.target || event.srcElement || event.currentTarget;
    alert("I did something: " + target.innerText);
  }
}
